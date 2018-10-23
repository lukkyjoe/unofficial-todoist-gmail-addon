/**
 * Returns an array of cards that comprise the customized authorization
 * prompt. Includes a button that opens the proper authorization link
 * for a non-Google service.
 *
 * When creating the text button, using the
 * setOnClose(CardService.OnClose.RELOAD_ADD_ON) function forces the add-on
 * to refresh once the authorization flow completes.
 *
 * @returns {Card[]} The card representing the custom authorization prompt.
 */
function create3PAuthorizationUi() {
  var service = getOAuthService();
  var authUrl = service.getAuthorizationUrl();
  var authButton = CardService.newTextButton()
      .setText('Begin Authorization')
      .setAuthorizationAction(CardService.newAuthorizationAction()
          .setAuthorizationUrl(authUrl));

  var promptText =
      'To show you information from your 3P account that is relevant' +
      ' to the recipients of the email, this add-on needs authorization' +
      ' to: <ul><li>Read recipients of the email</li>' +
      '         <li>Read contact information from 3P account</li></ul>.';

  var card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
          .setTitle('Authorization Required'))
      .addSection(CardService.newCardSection()
          .setHeader('This add-on needs access to your 3P account.')
          .addWidget(CardService.newTextParagraph()
              .setText(promptText))
          .addWidget(CardService.newButtonSet()
              .addButton(authButton)))
      .build();
  return [card];
}  

function addTask(e) {
  accessProtectedResource('https://beta.todoist.com/API/v8/tasks', 'post', {}, e.parameters.subject);

  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
          .setText('Added task'))
      .build();
}

function getContextualAddOn(e) {
  
    // Activate temporary Gmail add-on scopes, in this case to allow
    // message metadata to be read.
    var accessToken = e.messageMetadata.accessToken;
    GmailApp.setCurrentMessageAccessToken(accessToken);

    var messageId = e.messageMetadata.messageId;
    var message = GmailApp.getMessageById(messageId);
    var subject = message.getSubject();
    var sender = message.getFrom();

//    function addTask() {
//      return accessProtectedResource('https://beta.todoist.com/API/v8/tasks', 'post', {}, subject);
//    };
  
  var addTaskAction = CardService.newAction().setFunctionName('addTask').setParameters({'subject': subject});
  
    // var fooButton = CardService.newTextButton().setText('Create Task').setOnClickAction();
    var fooButton = CardService.newTextButton().setText('Create Task').setOnClickAction(addTaskAction);
  
    // Create a card with a single card section and two widgets.
    // Be sure to execute build() to finalize the card construction.
    var exampleCard = CardService.newCardBuilder()
        .setHeader(CardService.newCardHeader()
            .setTitle('Unofficial Todoist Addon'))
        .addSection(CardService.newCardSection()
            .addWidget(CardService.newButtonSet().addButton(createToCardButton(1)))
            .addWidget(CardService.newKeyValue()
                .setTopLabel('Task Name')
                .setContent(subject))
            .addWidget(CardService.newKeyValue()
                .setTopLabel('Due Date')
                .setContent('Today'))               
            .addWidget(CardService.newButtonSet().addButton(fooButton)))
        .build();   // Don't forget to build the Card!
    return [exampleCard];
  }

// ...

var action = CardService.newAction().setFunctionName('notificationCallback');
CardService.newTextButton().setText('Create notification').setOnClickAction(action);

// ...

function notificationCallback() {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
          .setText("Task created"))
      .build();
}



/**
 * Attempts to access a non-Google API using a constructed service
 * object.
 *
 * If your add-on needs access to non-Google APIs that require OAuth,
 * you need to implement this method. You can use the OAuth1 and
 * OAuth2 Apps Script libraries to help implement it.
 *
 * @param {String} url         The URL to access.
 * @param {String} method_opt  The HTTP method. Defaults to GET.
 * @param {Object} headers_opt The HTTP headers. Defaults to an empty
 *                             object. The Authorization field is added
 *                             to the headers in this method.
 * @returns {HttpResponse} the result from the UrlFetchApp.fetch() call.
 */
function accessProtectedResource(url, method_opt, headers_opt, content) {
  var service = getOAuthService();
  var maybeAuthorized = service.hasAccess();
  if (maybeAuthorized) {
    // A token is present, but it may be expired or invalid. Make a
    // request and check the response code to be sure.

    // Make the UrlFetch request and return the result.
    var accessToken = service.getAccessToken();
    var method = method_opt || 'get';
    var headers = headers_opt || {};
    headers['Authorization'] =
        Utilities.formatString('Bearer %s', accessToken);
    headers['Content-Type'] = 'application/json';
    var resp = UrlFetchApp.fetch(url, {
      'headers': headers,
      'method' : method,
      'muteHttpExceptions': true, // Prevents thrown HTTP exceptions.
      'payload': JSON.stringify({content: content, due_string: 'today'}), 
    });

    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      return resp.getContentText("utf-8"); // Success
    } else if (code == 401 || code == 403) {
       // Not fully authorized for this action.
       maybeAuthorized = false;
    } else {
       // Handle other response codes by logging them and throwing an
       // exception.
       console.error("Backend server error (%s): %s", code.toString(),
                     resp.getContentText("utf-8"));
       throw ("Backend server erroryyy: " + accessToken + maybeAuthorized.toString() + code);
    }
  } else {
      CardService.newAuthorizationException()
        .setAuthorizationUrl(service.getAuthorizationUrl())
        .setResourceDisplayName("Display name to show to the user")
        .setCustomUiCallback('create3PAuthorizationUi')
        .throwException();
    }
}


/**
 * Create a new OAuth service to facilitate accessing an API.
 * This example assumes there is a single service that the add-on needs to
 * access. Its name is used when persisting the authorized token, so ensure
 * it is unique within the scope of the property store. You must set the
 * client secret and client ID, which are obtained when registering your
 * add-on with the API.
 *
 * See the Apps Script OAuth2 Library documentation for more
 * information:
 *   https://github.com/googlesamples/apps-script-oauth2#1-create-the-oauth2-service
 *
 *  @returns A configured OAuth2 service object.
 */
function getOAuthService() {
  return OAuth2.createService('todoist')
  .setAuthorizationBaseUrl('https://todoist.com/oauth/authorize/')
      .setTokenUrl('https://todoist.com/oauth/access_token/')
      .setClientId('551437f2ec0247b59ea6ae231d9270a1')
      .setClientSecret('0e2b6c3e78fd4751a2d1e23086156df7')
      .setScope('data:read_write')
      .setCallbackFunction('authCallback')
      .setCache(CacheService.getUserCache())
      .setPropertyStore(PropertiesService.getUserProperties());
}

/**
 * Boilerplate code to determine if a request is authorized and returns
 * a corresponding HTML message. When the user completes the OAuth2 flow
 * on the service provider's website, this function is invoked from the
 * service. In order for authorization to succeed you must make sure that
 * the service knows how to call this function by setting the correct
 * redirect URL.
 *
 * The redirect URL to enter is:
 * https://script.google.com/macros/d/<Apps Script ID>/usercallback
 *
 * See the Apps Script OAuth2 Library documentation for more
 * information:
 *   https://github.com/googlesamples/apps-script-oauth2#1-create-the-oauth2-service
 *
 *  @param {Object} callbackRequest The request data received from the
 *                  callback function. Pass it to the service's
 *                  handleCallback() method to complete the
 *                  authorization process.
 *  @returns {HtmlOutput} a success or denied HTML message to display to
 *           the user. Also sets a timer to close the window
 *           automatically.
 */
function authCallback(callbackRequest) {
  var authorized = getOAuthService().handleCallback(callbackRequest);
  if (authorized) {
    return HtmlService.createHtmlOutput(
      'Success! <script>setTimeout(function() { top.window.close() }, 1);</script>');
  } else {
    return HtmlService.createHtmlOutput('Denied');
  }
}

/**
 * Unauthorizes the non-Google service. This is useful for OAuth
 * development/testing.  Run this method (Run > resetOAuth in the script
 * editor) to reset OAuth to re-prompt the user for OAuth.
 */
function resetOAuth() {
  getOAuthService().reset();
}


/** 
function get3PAuthorizationUrls() {
  return getOAuthService().getAuthorizationUrl();
} 
*/

/**
* Build a simple card with a button that sends a notification.
* @return {Card}
*/
function buildSimpleCard() {
  var buttonAction = CardService.newAction()
  .setFunctionName('notifyUser')
  .setParameters({'notifyText': 'Button clicked!'});
  var button = CardService.newTextButton()
  .setText('Notify')
  .setOnClickAction(buttonAction);
  
  // ...continue creating widgets, then create a Card object
  // to add them to. Return the built Card object.
}

/**
* Callback function for a button action. Constructs a
* notification action response and returns it.
* @param {Object} e the action event object
* @return {ActionResponse}
*/
function notifyUser(e) {
  var parameters = e.parameters;
  var notificationText = parameters['notifyText'];
  return CardService.newActionResponseBuilder()
  .setNotification(CardService.newNotification()
                   .setText(notificationText)
                   .setType(CardService.NotificationType.INFO))
  .build();      // Don't forget to build the response!
}

function gotoRootCard() {
  var nav = CardService.newNavigation().popToRoot();
  return CardService.newActionResponseBuilder()
  .setNavigation(nav)
  .build();
}

function gotoChildCard(e) {
  var id = parseInt(e.parameters.id);  // Current card ID
  var id2 = (id==3) ? 1 : id + 1;      // 2nd card ID
  var id3 = (id==1) ? 3 : id - 1;      // 3rd card ID
  var title = 'CARD ' + id;
  
  // Create buttons that go to the other two child cards.
  var buttonSet = CardService.newButtonSet()
  .addButton(createToCardButton(id2))
  .addButton(createToCardButton(id3));
  
  // Build the child card.
  var card = CardService.newCardBuilder()
  .setHeader(CardService.newCardHeader().setTitle(title))
  .addSection(CardService.newCardSection()
              .addWidget(buttonSet)
              .addWidget(buildPreviousAndRootButtonSet()))
  .build();
  
  // Create a Navigation object to push the card onto the stack.
  // Return a built ActionResponse that uses the navigation object.
  var nav = CardService.newNavigation().pushCard(card);
  return CardService.newActionResponseBuilder()
  .setNavigation(nav)
  .build();
}

function createToCardButton(id) {
  var action = CardService.newAction()
  .setFunctionName('gotoChildCard')
  .setParameters({'id': id.toString()});
  var button = CardService.newTextButton()
  .setText('Card ' + id)
  .setOnClickAction(action);
  return button;
}

function buildPreviousAndRootButtonSet() {
  var previousButton = CardService.newTextButton()
  .setText('Back')
  .setOnClickAction(CardService.newAction()
                    .setFunctionName('gotoPreviousCard'));
  var toRootButton = CardService.newTextButton()
  .setText('To Root')
  .setOnClickAction(CardService.newAction()
                    .setFunctionName('gotoRootCard'));
  
  // Return a new ButtonSet containing these two buttons.
  return CardService.newButtonSet()
  .addButton(previousButton)
  .addButton(toRootButton);
}

function gotoPreviousCard() {
  var nav = CardService.newNavigation().popCard();
  return CardService.newActionResponseBuilder()
  .setNavigation(nav)
  .build();
}