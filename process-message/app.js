const aws = require('aws-sdk');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });

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
    try {
        response = {
            'isBase64Encoded': false,
            'headers': {}
        }
        const body = JSON.parse(event.body);
        if(body.type === 'url_verification') {
            console.log('url_verification');
            Object.assign(response, {
                'statusCode': 200,
                'body': JSON.stringify({ challenge: body.challenge })
            });
        } else if (body.type === 'event_callback'){
            console.log('event_callback');
            
            // TODO: Process keywords in message and store alongside body
            // TODO: To generate link to previous message, take the following: https://winedirectteam.slack.com/archives/${body.event.channel}/p${body.event.event_ts.replace('.','')}
            var params = {
                Body: JSON.stringify(body), 
                Bucket: process.env.BUCKET_NAME, 
                Key: `${body.event.channel}/p${body.event.event_ts.replace('.','')}.json`
            };
            console.log('params', params);
            const s3Response = await s3.putObject(params).promise();
            console.log('s3 response: ', s3Response);
            
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