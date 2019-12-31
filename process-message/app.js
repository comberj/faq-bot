const aws = require('aws-sdk')
const comprehend = new aws.Comprehend();
const { WebClient } = require('@slack/web-api');
const slack = new WebClient(process.env.SLACK_TOKEN);

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
            Object.assign(response, {
                'statusCode': 200,
                'body': JSON.stringify({ challenge: body.challenge })
            });
        } else if (body.type === 'event_callback'){
            // Store metaData in body
            body.metaData = {
              type: calculateEventType(body.event)
            };
            
            if (body.metaData.type === 'question') {
                await mysql.query('CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, message_ts VARCHAR(100), channel VARCHAR(50), keyword VARCHAR(255));')
                
                const channel = body.event.channel;
                const message_ts = body.event.event_ts;
                const messageCheck = await mysql.query('SELECT COUNT(*) as messageCount FROM messages WHERE message_ts = ?', [message_ts]);
                if (messageCheck[0].messageCount === 0) {
                    var params = {
                      LanguageCode: 'en',
                      Text: body.event.text
                    };
                    const entities = await comprehend.detectEntities(params).promise();
                    const keyPhrases = await comprehend.detectKeyPhrases(params).promise();

                    let keywords = entities.Entities.concat(keyPhrases.KeyPhrases).map(function(k) { return k.Text });
                    body.metaData.keywords = keywords;

                    const result_query = `
                        SELECT COUNT(id) as hits, message_ts, channel
                        FROM messages
                        WHERE keyword IN (${keywords.map(function (k) { return "'" + k.replace("'", "''") + "'"; }).join()})
                            AND channel = ?
                        GROUP BY message_ts, channel
                        ORDER BY hits DESC
                    `;
                    let keywordResults = await mysql.query(result_query, [channel]);
                    console.log('Search Results:', keywordResults);

                    if (keywordResults.length > 0) {
                        const answerMessage = `I found some similar questions from this channel, these might help: ${generateSlackLinks(keywordResults)}`;
                        const slackResponse = await slack.chat.postMessage({ channel: channel, thread_ts: message_ts, text: answerMessage });
                        console.log('Slack Response:', slackResponse);
                    }

                    const insert_message_query = `
                        INSERT INTO messages (message_ts,channel,keyword)
                        VALUES ${keywords.map(function (k) { return `('${message_ts}','${channel}','${k.replace("'", "''")}')`}).join()};
                    `;
                    await mysql.query(insert_message_query);
                }
            }
            
            Object.assign(response, {
                'statusCode': 200,
                'body': JSON.stringify(body)
            });
        };
    } catch (err) {
        console.log(err);
        return err;
    }
    
    await mysql.end()

    console.log(response);
    return response;
};

function calculateEventType(event) {
    if (event.subtype && event.subtype === 'channel_join' && event.user === process.env.SLACK_BOT_USER_ID) {
        return 'bot_joined';
    } else {
        return typeof event.thread_ts !== 'undefined' ? 'answer' : 'question'
    }
}

function generateSlackLinks(results) {
    return results.map(function(r) {
        return `\nhttps://winedirectteam.slack.com/archives/${r.channel}/p${r.message_ts.replace('.','')}`
    }).join('');
}