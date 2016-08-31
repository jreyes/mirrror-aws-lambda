const IOT_ENDPOINT = 'YOUR_IOT_ENDPOINT';
const IOT_TOPIC = '$aws/things/smart-mirror/shadow/update';
const IOT_COMMANDS = [
    createCommand('e219f5e9-2d58-4fde-807b-cefec4dc4900', 'home'),
    createCommand('e219f5e9-2d58-4fde-807b-cefec4dc4901', 'c. b. s.'),
    createCommand('e219f5e9-2d58-4fde-807b-cefec4dc4902', 'connect to the internet'),
    createCommand('e219f5e9-2d58-4fde-807b-cefec4dc4903', 'x. k. c. d.'),
    createCommand('e219f5e9-2d58-4fde-807b-cefec4dc4904', 'display my flickr stream'),
    createCommand('e219f5e9-2d58-4fde-807b-cefec4dc4905', 'miku time'),
    createCommand('e219f5e9-2d58-4fde-807b-cefec4dc4906', 'new music releases')
];

var AWS = require('aws-sdk');
var iotdata = new AWS.IotData({endpoint: IOT_ENDPOINT});

/**
 * Main entry point.
 */
exports.handler = function (event, context) {

    switch (event.header.namespace) {

        /**
         * The namespace of "Discovery" indicates a request is being made to the lambda for
         * discovering all appliances associated with the customer's appliance cloud account.
         * can use the accessToken that is made available as part of the payload to determine
         * the customer.
         */
        case 'Alexa.ConnectedHome.Discovery':
            handleDiscovery(event, context);
            break;

        /**
         * The namespace of "Control" indicates a request is being made to us to turn a
         * given device on, off or brighten. This message comes with the "appliance"
         * parameter which indicates the appliance that needs to be acted on.
         */
        case 'Alexa.ConnectedHome.Control':
            handleControl(event, context);
            break;

        /**
         * We received an unexpected message
         */
        default:
            log('Err', 'No supported namespace: ' + event.header.namespace);
            context.fail('Something went wrong');
            break;
    }
};

/**
 * This method is invoked when we receive a "Discovery" message from Alexa Smart Home Skill.
 * We are expected to respond back with a list of appliances that we have discovered for a given
 * customer.
 */
function handleDiscovery(event, context) {
    var messageId = event.header.messageId;
    if (event.header.name != 'DiscoverAppliancesRequest') {
        context.fail(generateControlError('DiscoverAppliancesRequest', messageId, 'UNSUPPORTED_OPERATION', 'Unrecognized operation'));
        return;
    }
    var headers = {
        namespace: 'Alexa.ConnectedHome.Discovery',
        name: 'DiscoverAppliancesResponse',
        payloadVersion: '2'
    };
    var payloads = {
        discoveredAppliances: IOT_COMMANDS
    };
    var result = {
        header: headers,
        payload: payloads
    };
    log('Discovery', result);
    context.succeed(result);
}

/**
 * Control events are processed here.
 * This is called when Alexa requests an action (IE turn off appliance).
 */
function handleControl(event, context) {
    var messageId = event.header.messageId;
    if (event.header.name !== 'TurnOnRequest') {
        context.fail(generateControlError('TurnOnRequest', messageId, 'UNSUPPORTED_OPERATION', 'Unrecognized operation'));
    } else {
        api(event.payload.appliance.applianceId, messageId, context);
    }
}

function createCommand(applianceId, command) {
    return {
        applianceId: applianceId,
        manufacturerName: 'VaporwareCorp',
        modelName: 'ST01',
        version: 'VER01',
        friendlyName: command,
        friendlyDescription: command + " command",
        isReachable: true,
        actions: ['turnOn']
    };
}

function api(applianceId, messageId, context) {
    var command = null;
    for (var i in IOT_COMMANDS) {
        if (IOT_COMMANDS[i].applianceId === applianceId) {
            command = IOT_COMMANDS[i].friendlyName;
        }
    }
    var payload = {
        command: command,
        state: {}
    };
    var params = {
        topic: IOT_TOPIC,
        payload: JSON.stringify(payload),
        qos: 0
    };
    log("api", params);
    iotdata.publish(params, function (err, data) {
        if (err) {   // an error occurred
            log("Publish Error", err.stack);
            context.fail(generateControlError('TurnOnRequest', messageId, 'DEPENDENT_SERVICE_UNAVAILABLE', 'Unable to connect to server'));
        } else {  // successful response
            log("Publish Success", data);
            context.succeed(generateControlSuccess(messageId));
        }
    });
}

function log(title, msg) {
    console.log('*** ' + title + ' : ' + JSON.stringify(msg));
}

function generateControlSuccess(messageId) {
    var headers = {
        namespace: 'Alexa.ConnectedHome.Control',
        name: 'TurnOnConfirmation',
        payloadVersion: '2',
        messageId: messageId
    };
    var payloads = {
        success: true
    };
    return {
        header: headers,
        payload: payloads
    };
}

function generateControlError(name, messageId, code, description) {
    var headers = {
        namespace: 'Alexa.ConnectedHome.Control',
        name: name,
        payloadVersion: '2',
        messageId: messageId
    };
    var payload = {
        exception: {
            code: code,
            description: description
        }
    };
    return {
        header: headers,
        payload: payload
    };
}