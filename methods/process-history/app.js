const aws = require('aws-sdk')
const comprehend = new aws.Comprehend();

const mysql = require('serverless-mysql')({
    config: {
        host     : process.env.DB_HOST,
        database : process.env.DB_NAME,
        user     : process.env.DB_USER,
        password : process.env.DB_PASSWORD
    }
})

exports.lambdaHandler = async (event, context) => {
	context.callbackWaitsForEmptyEventLoop = false;
	
	const records = event.Records
	const sqlParams = [];
	
	for(record of records){
		let text = record.messageAttributes.text.stringValue;
		let channel = record.messageAttributes.channel.stringValue;
		let ts = record.messageAttributes.ts.stringValue;
		
		var params = {
			LanguageCode: 'en',
			Text: text
		};
		
		const entities = await comprehend.detectEntities(params).promise();
		const keyPhrases = await comprehend.detectKeyPhrases(params).promise();
		
		const keywords = entities.Entities.concat(keyPhrases.KeyPhrases).map(function(k) { return k.Text });
		
		for(keyword of keywords){
			sqlParams.push({
				message_ts: ts,
				keyword: keyword,
				channel: channel
			})
		};
	};
	
	await mysql.query('CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, message_ts VARCHAR(100), channel VARCHAR(50), keyword VARCHAR(255));');
	// Bulk insert keywords into mysql
	const bulkInsertQuery = `
		INSERT INTO messages (message_ts,channel,keyword)
		VALUES ${sqlParams.map(function (s) { return `('${s.message_ts}','${s.channel}','${s.keyword.replace("'", "''")}')`}).join()};
	`;
	const queryResponse = await mysql.query(bulkInsertQuery);
	console.log('Bulk Insert Query Results: ', queryResponse);
	
	return {}
}
