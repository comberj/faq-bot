const mysql = require('serverless-mysql')({
    config: {
        host     : process.env.DB_HOST,
        database : process.env.DB_NAME,
        user     : process.env.DB_USER,
        password : process.env.DB_PASSWORD
    }
})

const aws = require('aws-sdk')
const comprehend = new aws.Comprehend();
const { WebClient } = require('@slack/web-api');
const slack = new WebClient(process.env.SLACK_TOKEN);

const QuestionEvent = function(body, context) {
	this.body = body;
	this.context = context;
	this.response = {
		'isBase64Encoded': false,
		'headers': {}
	};
}

QuestionEvent.prototype.process = async function(){
	await mysql.query('CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, message_ts VARCHAR(100), channel VARCHAR(50), keyword VARCHAR(255));');

	const channel = this.body.event.channel;
	const message_ts = this.body.event.event_ts;
	const messageCheck = await mysql.query('SELECT COUNT(*) as messageCount FROM messages WHERE message_ts = ?', [message_ts]);
	if (messageCheck[0].messageCount === 0) {
		var params = {
			LanguageCode: 'en',
			Text: this.body.event.text
		};
		const entities = await comprehend.detectEntities(params).promise();
		const keyPhrases = await comprehend.detectKeyPhrases(params).promise();

		let keywords = entities.Entities.concat(keyPhrases.KeyPhrases).map(function(k) { return k.Text });
		this.body.keywords = keywords;

		// Finds at most 3 related questions that have at least 2 matching keywords
		const result_query = `
			SELECT COUNT(id) as hits, message_ts, channel
			FROM messages
			WHERE keyword IN (${keywords.map(function (k) { return "'" + k.replace("'", "''") + "'"; }).join()})
				AND channel = ?
			GROUP BY message_ts, channel
			HAVING hits > 1
			ORDER BY hits DESC
			LIMIT 3
		`;
		let keywordResults = await mysql.query(result_query, [channel]);
		console.log('Search Results:', keywordResults);

		if (keywordResults.length > 0) {
			const answerMessage = `I found some similar questions from this channel, these might help: ${this.generateSlackLinks(keywordResults)}`;
			const slackResponse = await slack.chat.postMessage({ channel: channel, thread_ts: message_ts, text: answerMessage });
			console.log('Slack Response:', slackResponse);
		}

		const insert_message_query = `
			INSERT INTO messages (message_ts,channel,keyword)
			VALUES ${keywords.map(function (k) { return `('${message_ts}','${channel}','${k.replace("'", "''")}')`}).join()};
		`;
		await mysql.query(insert_message_query);
	}
	
	Object.assign(this.response, {
		'statusCode': 200,
		'body': JSON.stringify(this.body)
	});

	return this.response;
}

QuestionEvent.prototype.generateSlackLinks = function(results) {
    return results.map(function(r) {
        return `\nhttps://winedirectteam.slack.com/archives/${r.channel}/p${r.message_ts.replace('.','')}`
    }).join('');
}

module.exports = QuestionEvent;
