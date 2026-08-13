# SecureDApp CMS — Client Integration API

These APIs allow client applications to integrate with the SecureDApp Consent Management Platform (CMS) to manage user consents, check consent states, initiate hosted redirect consent flows, and listen to consent events via webhooks.

All endpoints listed below are official, stable, and supported for tenant client application integrations.

---

#### Table of Contents
- [General API Information](#general-api-information)
- [Authentication](#authentication)
  - [API Key Authentication](#api-key-authentication)
  - [mTLS Option (Mutual TLS)](#mtls-option-mutual-tls)
- [Public Consent APIs](#public-consent-apis)
  - [/public/purposes](#get-publicpurposes)
    - List all active consent purposes.
  - [/public/apps/{appId}/policy](#get-publicappsappidpolicy)
    - Get active policy and consent configuration.
  - [/public/apps/{appId}/consent (Grant)](#post-publicappsappidconsent)
    - Record consent grant (Embedded Flow).
  - [/public/apps/{appId}/consent (Withdraw)](#delete-publicappsappidconsent)
    - Revoke/Withdraw consent (Embedded Flow).
  - [/public/apps/{appId}/consent/state](#post-publicappsappidconsentstate)
    - Query active consent state for a user.
  - [/public/apps/{appId}/consent/redirect/request](#post-publicappsappidconsentredirectrequest)
    - Initiate a Hosted/Redirect Consent verification flow.
  - [/public/apps/{appId}/consent/initiate](#post-publicappsappidconsentinitiate)
    - Initiate minor-aware or guardian consent flows.
  - [/public/consent/guardian/{token}/nominate](#post-publicconsentguardiantokennominate)
    - Nominate a guardian for minor consent.
- [Webhooks Integration](#webhooks-integration)
  - [Event Subscriptions](#event-subscriptions)
  - [Webhook Payload Schema](#webhook-payload-schema)
  - [Signature Verification](#signature-verification)

---
<a id="general-api-information"></a>
## General API Information
- **Production Base Endpoint:** `https://cmsbe.securedapp.io`
- All request and response bodies must be formatted in **JSON** (except for hosted template pages).
- Rate limits apply per API Key. Ensure endpoints are called efficiently.

---
<a id="authentication"></a>
## Authentication
<a id="api-key-authentication"></a>
### API Key Authentication
All public client requests require the `x-api-key` header containing your public API Key (generated under the Developer Options in your Tenant Dashboard):

```http
x-api-key: your_public_api_key_here
Content-Type: application/json
```
<a id="mtls-option-mutual-tls"></a>
### mTLS Option (Mutual TLS)
If the tenant has mTLS enforced, all HTTPS calls must establish a TLS handshake using:
- The **Root CA Certificate** (downloadable from the Tenant Dashboard).
- The **Client Certificate** signed by the CMS CA.
- Your locally generated private key (never shared with the CMS).

---
<a id="public-consent-apis"></a>
## Public Consent APIs

<a id="get-publicpurposes"></a>
### GET `/public/purposes`
List all active data collection purposes configured by the tenant.

#### Request
`GET {{domain}}/public/purposes`

#### Response
```json
{
  "purposes": [
    {
      "id": "purpose-id",
      "name": "analytics",
      "description": "analytic",
      "required": false,
      "required_data": [
        "browser_details",
        "city",
        "clickstream"
      ],
      "validity_days": 60,
      "permissions": null
    }
  ]
}
```

---
<a id="get-publicappsappidpolicy"></a>
### GET `/public/apps/{appId}/policy`
Fetch the active privacy policy details, terms, and consent flows (embedded vs. redirect) for the application.

#### Request
`GET {{domain}}/public/apps/{appId}/policy`

**Headers (Optional):**
- `x-user-email` or query parameter `email`: If provided, resolves the identity's language preference and current policy signature status.

#### Response
```json
{
  "policyVersion": {
    "id": "policy_v1_uuid",
    "version": "1.0.0",
    "consent_flow": "redirect", // or embedded
    "terms_link": "https://example.com/terms",
    "privacy_policy_link": "https://example.com/privacy"
  },
  "preferred_language": "en"
}
```

---
<a id="post-publicappsappidconsent"></a>
### POST `/public/apps/{appId}/consent`
Record a user's explicit consent grant (typically used in Embedded/In-App Consent Forms).

#### Request
`POST {{domain}}/public/apps/{appId}/consent`

#### Request Body
```json
{
  "email": "user@example.com",
  "phone_number": "1234567890",
  "purpose_ids": ["purpose_uuid_1", "purpose_uuid_2"],
  "policy_version_id": "policy_v1_uuid"
}
```
*Note: You must supply either `email`, `phone_number`, or both to identify the data principal.*

#### Response
```json
{
    "success": true,
    "consentId": null,
    "consentIds": [
        "generated-consent-id",
        "..."
    ],
    "purposesProcessed": 4,
    "granted_purposes": [
        {
            "purpose_id": "purpose-id",
            "name": "analytics",
            "description": "analytic",
            "data_points": [
                "browser_details",
                "city",
                "clickstream"
            ]
        },{…}
    ],
    "rejected_purposes": []
}

```

---
<a id="delete-publicappsappidconsent"></a>
### DELETE `/public/apps/{appId}/consent`
Revoke/withdraw consent for specific purposes (Embedded Flow).

#### Request
`DELETE {{domain}}/public/apps/{appId}/consent`

#### Request Body
```json
{
  "email": "user@example.com",
  "phone_number": "9876543210",
  "purpose_ids": ["purpose_uuid_1"]
}
```

#### Response
```json
{
    "success": true,
    "consentId": "8a14da13-cc62-40b2-960e-0184fe303a3c",
    "consentIds": [
        "8a14da13-cc62-40b2-960e-0184fe303a3c"
    ],
    "purposesProcessed": 1,
    "results": [
        {
            "purposeId": "192b0d93-b663-49d1-a830-8d8b4af94274",
            "consentId": "8a14da13-cc62-40b2-960e-0184fe303a3c",
            "alreadyWithdrawn": false
        }
    ]
}
```

---
<a id="post-publicappsappidconsentstate"></a>
### POST `/public/apps/{appId}/consent/state`
Check the current consent status (granted/denied) for an identity.

#### Request
`POST {{domain}}/public/apps/{appId}/consent/state`

#### Request Body
```json
{
  "email": "user@example.com",
  "phone_number": "9876543210"
}
```

#### Response
```json
{
    "user_id": "86e9c57a7d6b...eecf4d04b",
    "preferred_language": "en",
    "consents": [
        {
            "purposeId": "192b0d93-b663-49d1-a830-8d8b4af94274",
            "status": "withdrawn",
            "policyVersionId": "6dd4f3a1-1ea2-4dbd-b6b3-ae2cfdef50cc",
            "provider_type": "self",
            "guardian_name": null,
            "guardian_email": null,
            "timestamp": "2026-08-13T02:41:18.000Z"
        },{...}
    ]
}
```

---
<a id="post-publicappsappidconsentredirectrequest"></a>
### POST `/public/apps/{appId}/consent/redirect/request`
Initiates a **Redirect/Hosted Verification Flow**. It registers a request and returns a unique verification URL. Redirect the user to this URL to complete OTP/out-of-band verification.

#### Request
`POST {{domain}}/public/apps/{appId}/consent/redirect/request`

#### Request Body
```json
{
  "callback_url": "https://cms-test.securedapp.io",
  "dob": "1990-01-01",
  "email": "user@gmail.com",
  "mobile": "1234567890",
  "phone_number": "1234567890",
  "policy_version_id": "8f7b7785-6db5-4397-a462-4fa7961b7a82",
  "purpose_ids": [
    "7853cdff-f390-48e5-8258-19d30dd9cfc9",
    "ad705219-1401-4bb0-9935-2a8be94c9c41"
  ]
}
```

#### Response
```json
{
    "request_id": "4db10d1a-0d3d-4bdd-86dd-328ffb28d0b4",
    "flow": "standard",
    "status": "pending",
    "pop_url": "http://cmsbe.securedapp.io/public/consent/redirect/d2...bd",
    "redirect_url": "http://cmsbe.securedapp.io/public/consent/redirect/d2...bd",
    "guardian_nomination_required": false,
    "expires_at": "2026-08-13T03:18:24.539Z",
    "token": "d2...bd"
}
```

---
<a id="post-publicappsappidconsentinitiate"></a>
### POST `/public/apps/{appId}/consent/initiate`
Initiates minor-aware consent tracking (when user age is below the legal threshold), triggering guardian notification flows.

#### Request
`POST {{domain}}/public/apps/{appId}/consent/initiate`

#### Request Body
```json
{
  "callback_url": "https://cms-test.securedapp.io",
  "dob": "2012-02-19",
  "email": "minor-email@gmail.com",
  "mobile": "1234567890",
  "phone_number": "1234567890",
  "policy_version_id": "8f7b7785-6db5-4397-a462-4fa7961b7a82",
  "purpose_ids": [
    "7853cdff-f390-48e5-8258-19d30dd9cfc9",
    "ad705219-1401-4bb0-9935-2a8be94c9c41"
  ]
}
```

#### Response
```json
{
    "request_id": "5f3d5786-a4f1-48c8-b1a7-99e722b80b29",
    "flow": "guardian_required",
    "status": "pending_guardian",
    "pop_url": "http://cmsbe.securedapp.io/public/consent/redirect/d884c...086c?mode=guardian",
    "redirect_url": "http://cmsbe.securedapp.io/public/consent/redirect/d884c...086c?mode=guardian",
    "guardian_nomination_required": true,
    "expires_at": "2026-08-13T03:21:50.229Z",
    "token": "d884c...086c"
}
```

---
<a id="post-publicconsentguardiantokennominate"></a>
### POST `/public/consent/guardian/{token}/nominate`

Nominate a guardian for a minor consent request using the token returned from the consent initiation API.

#### Request

`POST {{domain}}/public/consent/guardian/{token-from-initiate-response}/nominate`

#### Request Body

```json
{
  "guardian_name": "Name",
  "guardian_email": "guardian-email@gmail.com",
  "guardian_phone": "1234567890",
  "relationship": "Parent",
  "relation": "Parent"
}
```


#### Response
```json

{
  "success": true,
  "status": "pending_guardian_verification",
  "linkage_id": "ffbf2836-594c-478d-8de3-622ee19a1a64"
}

```

Consent link is sent to guardian email where they can check the consent parameter and accept it using OTP.


---
<a id="webhooks-integration"></a>
## Webhooks Integration

Webhooks allow you to receive real-time HTTPS callbacks when critical consent actions happen in the system.
<a id="event-subscriptions"></a>
### Event Subscriptions
You can subscribe to the following events inside the Tenant Dashboard:
* `consent.granted`: Triggered when a user approves one or more data processing purposes.
* `consent.withdrawn`: Triggered when a user revokes consent.
* `dsr.created`: Triggered when a new Data Subject Request (Access, Rectification, Erasure) is lodged.
* `dsr.completed`: Triggered when a DSR request status changes to completed.
<a id="webhook-payload-schema"></a>
### Webhook Payload Schema
All callbacks are issued as HTTP `POST` requests. Here is an example payload for a `consent.granted` event:

```json
{
  "event": "consent.granted",
  "event_id": "evt_9a4f21",
  "timestamp": "2026-08-12T16:40:00.000Z",
  "tenant_id": "tenant_uuid_here",
  "app_id": "app_uuid_here",
  "consent": {
    "consent_id": "consent_receipt_uuid",
    "status": "granted",
    "policy_version_id": "policy_v1_uuid",
    "purposes": [
      {
        "purpose_id": "purpose_uuid_1",
        "name": "Marketing Email Subscription",
        "status": "granted"
      }
    ]
  },
  "user": {
    "user_id": "user@example.com",
    "mobile": "+919876543210",
    "email": "user@example.com"
  },
  "verification": {
    "method": "otp",
    "channel": "email",
    "verified": true,
    "verified_at": "2026-08-12T16:39:50.000Z"
  },
  "context": {
    "channel": "web",
    "ip_address": "192.168.x.x",
    "user_agent": "Mozilla/5.0...",
    "geo": "IN"
  },
  "metadata": {
    "source": "redirect_flow",
    "version": "v1"
  }
}
```
<a id="signature-verification"></a>
### Signature Verification
To prevent spoofing, each webhook request contains two headers:
* `x-webhook-timestamp`: The Unix epoch timestamp (in seconds) of when the dispatch occurred.
* `x-webhook-signature`: A signature hash verifying the authenticity of the message.

#### Verifying signatures in Node.js
```javascript
const crypto = require('crypto');

function verifyWebhook(secret, rawBody, signatureHeader, timestampHeader) {
  // 1. Check for replay attacks (e.g., within 5 minutes)
  const fiveMinutesInSeconds = 300;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - parseInt(timestampHeader, 10)) > fiveMinutesInSeconds) {
    throw new Error('Timestamp deviation too large. Possible replay attack.');
  }

  // 2. Re-create the signed string: <timestamp>.<rawPayload>
  const payloadToSign = `${timestampHeader}.${rawBody}`;

  // 3. Compute HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadToSign)
    .digest('hex');

  // 4. Compare signatures securely
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```
