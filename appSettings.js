require('dotenv').config()

const settings = {
  clientId: process.env.AAD_CLIENT_ID,
  tenantId: process.env.AAD_TENANT_ID,
  graphUserScopes: ['user.readwrite', 'mail.read', 'mail.send'],
}

module.exports = settings
