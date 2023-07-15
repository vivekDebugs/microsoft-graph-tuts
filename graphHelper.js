require('isomorphic-fetch')
const azure = require('@azure/identity')
const graph = require('@microsoft/microsoft-graph-client')
const authProviders = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials')
const fs = require('fs')

let _settings = undefined
let _deviceCodeCredential = undefined
let _userClient = undefined

function initializeGraphForUserAuth(settings, deviceCodePrompt) {
  // Ensure settings isn't null
  if (!settings) {
    throw new Error('Settings cannot be undefined')
  }

  _settings = settings

  _deviceCodeCredential = new azure.DeviceCodeCredential({
    clientId: settings.clientId,
    tenantId: settings.tenantId,
    userPromptCallback: deviceCodePrompt,
  })

  const authProvider = new authProviders.TokenCredentialAuthenticationProvider(
    _deviceCodeCredential,
    {
      scopes: settings.graphUserScopes,
    }
  )

  _userClient = graph.Client.initWithMiddleware({
    authProvider: authProvider,
  })
}

async function getUserTokenAsync() {
  // Ensure credential isn't undefined
  if (!_deviceCodeCredential) {
    throw new Error('Graph has not been initialized for user auth')
  }

  // Ensure scopes isn't undefined
  if (!_settings?.graphUserScopes) {
    throw new Error('Setting "scopes" cannot be undefined')
  }

  // Request token with given scopes
  const response = await _deviceCodeCredential.getToken(
    _settings?.graphUserScopes
  )
  return response.token
}

async function getUserAsync() {
  // Ensure client isn't undefined
  if (!_userClient) {
    throw new Error('Graph has not been initialized for user auth')
  }

  return (
    _userClient
      .api('/me')
      // Only request specific properties
      .select(['displayName', 'mail', 'userPrincipalName'])
      .get()
  )
}

async function getInboxAsync() {
  // Ensure client isn't undefined
  if (!_userClient) {
    throw new Error('Graph has not been initialized for user auth')
  }

  return _userClient
    .api('/me/mailFolders/inbox/messages')
    .select(['from', 'isRead', 'receivedDateTime', 'subject'])
    .top(25)
    .orderby('receivedDateTime DESC')
    .get()
}

async function sendMailAsync(subject, body, recipient) {
  // Ensure client isn't undefined
  if (!_userClient) {
    throw new Error('Graph has not been initialized for user auth')
  }

  // Create a new message
  const message = {
    subject: subject,
    body: {
      content: body,
      contentType: 'text',
    },
    toRecipients: [
      {
        emailAddress: {
          address: recipient,
        },
      },
    ],
  }

  // Send the message
  return _userClient.api('me/sendMail').post({
    message: message,
  })
}

async function makeGraphCallAsync() {
  try {
    await getUserPhotoAsync()
    await updateUserProfilePhotoAsync()
  } catch (error) {
    console.log(error)
  }
}

async function getUserPhotoAsync() {
  // Ensure client isn't undefined
  if (!_userClient) {
    throw new Error('Graph has not been initialized for user auth')
  }

  const blob = await _userClient.api('/me/photo/$value').get()
  await saveBlob(blob)
}

async function saveBlob(blob) {
  try {
    const dir = 'artifacts'
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }
    const buffer = Buffer.from(await blob.arrayBuffer())
    fs.writeFileSync(dir + '/profile.jpg', buffer)
  } catch (error) {
    console.log(error)
  }
}

async function updateUserProfilePhotoAsync() {
  // Ensure client isn't undefined
  if (!_userClient) {
    throw new Error('Graph has not been initialized for user auth')
  }

  try {
    const dir = 'artifacts'
    const imageBin = await getFileData(dir + '/new-profile.jpg')

    await _userClient.api('/me/photo/$value').put(imageBin)
  } catch (error) {
    console.log(error)
  }
}

async function getFileData(filePath) {
  return new Promise((res, rej) => {
    fs.readFile(filePath, (err, data) => {
      if (err) rej(err)
      else res(data)
    })
  })
}

module.exports = {
  initializeGraphForUserAuth,
  getUserTokenAsync,
  getUserAsync,
  getInboxAsync,
  sendMailAsync,
  makeGraphCallAsync,
}
