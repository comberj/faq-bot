// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';
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
        // const ret = await axios(url);
        // response = {
        //     'statusCode': 200,
        //     'body': JSON.stringify({
        //         message: 'hello world',
        //         // location: ret.data.trim()
        //     })
        // }
        const body = JSON.parse(event.body);
        if(body.type === 'url_verification') {
            console.log('url_verification');
            response = {
                'statusCode': 200,
                'body': JSON.stringify({ challenge: body.challenge }),
                'isBase64Encoded': false,
                'headers': {}
            };
        } else if (body.type === 'event_callback'){
            console.log('event_callback');
            response = {
                'statusCode': 200,
                'body': JSON.stringify(body),
                'isBase64Encoded': false,
                'headers': {}
            };
        };
    } catch (err) {
        console.log(err);
        return err;
    }

    console.log(response);
    return response;
};