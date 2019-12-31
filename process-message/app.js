const aws = require('aws-sdk')
const comprehend = new aws.Comprehend();
// const s3 = new aws.S3({ apiVersion: '2006-03-01' });

// Require and initialize outside of your main handler
const mysql = require('serverless-mysql')({
    config: {
        host     : process.env.DB_HOST,
        database : process.env.DB_NAME,
        user     : process.env.DB_USER,
        password : process.env.DB_PASSWORD
    }
})
  
let response;

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */

exports.lambdaHandler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    
    try {
        response = {
            'isBase64Encoded': false,
            'headers': {}
        }
        console.log('event.body', event.body);
        const body = JSON.parse(event.body);
        if(body.type === 'url_verification') {
            console.log('url_verification');
            Object.assign(response, {
                'statusCode': 200,
                'body': JSON.stringify({ challenge: body.challenge })
            });
        } else if (body.type === 'event_callback'){
            console.log('event_callback');
            
            var params = {
              LanguageCode: 'en',
              Text: body.event.text
            };
            const entities = await comprehend.detectEntities(params).promise();
            const keyPhrases = await comprehend.detectKeyPhrases(params).promise();
            
            let keywords = entities.Entities.concat(keyPhrases.KeyPhrases).map(function(k) { return k.Text });
            console.log('keywords: ', keywords);
            
            // Store metaData in body
            body.metaData = {
              type: typeof body.event.thread_ts !== 'undefined' ? 'answer' : 'question',
              keywords: keywords
            };
            
            if (body.metaData.type === 'question') {
                await mysql.query('CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, message_ts VARCHAR(100), channel VARCHAR(50), keyword VARCHAR(255));')
                const result_query = `
                    SELECT COUNT(id) as hits, message_ts, channel
                    FROM messages
                    WHERE keyword IN (${keywords.map(function (k) { return "'" + k.replace("'", "''") + "'"; }).join()})
                    GROUP BY message_ts, channel
                    ORDER BY hits DESC
                `;
                let keywordResults = await mysql.query(result_query);
                console.log('Search Results:', keywordResults);
                
                const insert_message_query = `
                    INSERT INTO messages (message_ts,channel,keyword)
                    VALUES ${keywords.map(function (k) { return `('${body.event.event_ts}','${body.event.channel}','${k.replace("'", "''")}')`}).join()};
                `;
                await mysql.query(insert_message_query);
            }
            
            // TODO: To generate link to previous message, take the following: https://winedirectteam.slack.com/archives/${body.event.channel}/p${body.event.event_ts.replace('.','')}
            
            Object.assign(response, {
                'statusCode': 200,
                'body': JSON.stringify(body)
            });
        };
    } catch (err) {
        console.log(err);
        return err;
    }

    console.log(response);
    return response;
};