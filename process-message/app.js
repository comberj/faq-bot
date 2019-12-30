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
            
            /*
                SELECT metaData.keywords, event.channel, event.event_ts
                FROM bucket
                WHERE 'the heck' IN (entities)
                    OR keyword2 IN (entities)
            */
            
            // Store metaData in body
            body.metaData = {
              type: typeof body.event.thread_ts !== 'undefined' ? 'answer' : 'question',
              keywords: keywords
            };
            
            if (body.metaData.type === 'question') {
                // CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, message_ts VARCHAR(100), channel VARCHAR(50), keyword VARCHAR(255));
                await mysql.query('CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, message_ts VARCHAR(100), channel VARCHAR(50), keyword VARCHAR(255));')
                const result_query = `
                    SELECT COUNT(id), message_ts, channel
                    FROM messages
                    WHERE keyword IN (${keywords.map(function (a) { return "'" + a.replace("'", "''") + "'"; }).join()})
                `
                let results = await mysql.query(result_query)
                console.log(results);
                // Search for like-questions
                // const expression = 'SELECT metaData.keywords, event.channel, event.event_ts FROM S3Object WHERE 1 = 1';
                // const params = {
                //     Bucket: process.env.BUCKET_NAME,
                //     Key: body.event.channel,
                //     ExpressionType: 'SQL',
                //     Expression: expression,
                //     InputSerialization: {
                //         JSON: {
                //             Type: 'DOCUMENT'
                //         }
                //     },
                //     OutputSerialization: {
                //         JSON: {}
                //     }
                // };
                
                // let queryResults = await s3.selectObjectContent(params).promise();
                // console.log('queryResults:', queryResults);
            }
            
            // TODO: To generate link to previous message, take the following: https://winedirectteam.slack.com/archives/${body.event.channel}/p${body.event.event_ts.replace('.','')}
            // var params = {
            //     Body: JSON.stringify(body), 
            //     Bucket: process.env.BUCKET_NAME, 
            //     Key: `${body.event.channel}/p${body.event.event_ts.replace('.','')}.json`
            // };
            // console.log('params', params);
            // const s3Response = await s3.putObject(params).promise();
            // console.log('s3 response: ', s3Response);
            
            // Object.assign(response, {
            //     'statusCode': 200,
            //     'body': JSON.stringify(body)
            // });
        };
    } catch (err) {
        console.log(err);
        return err;
    }

    console.log(response);
    return response;
};