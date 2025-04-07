// @ts-check
import * as core from "@actions/core";
import { HttpClient, MediaTypes } from "@actions/http-client";
import * as bt from "banditypes";

export default async function main() {
  try {
    const serviceAccountId = core.getInput("service-account", {
      required: true,
    });
    const audience = core.getInput("audience");

    let idToken;
    try {
      idToken = await core.getIDToken(audience);
    } catch (err) {
      core.error(
        "Error getting GitHub ID-token. Did you forget the permission (id-token: write)?"
      );
      throw err;
    }

    const tokenData = await getYcIamToken(idToken, serviceAccountId);

    core.setOutput("token", tokenData.token);
    core.setOutput("expires-in", tokenData.expiresIn);
    core.setSecret(tokenData.token);
  } catch (error) {
    core.setFailed(String(error));
  }
}

/**
 * @typedef TokenResponse
 * @type {object}
 * @property {string} token
 * @property {number} expiresIn
 */

/**
 * @param {string} idToken
 * @param {string} servAccId
 * @returns {Promise<TokenResponse>}
 */
async function getYcIamToken(idToken, servAccId) {
  const client = new HttpClient();

  const reqParams = {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    audience: servAccId,
    subject_token: idToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
  };
  const reqBody = new URLSearchParams(reqParams).toString();

  const resp = await client.post(
    "https://auth.yandex.cloud/oauth/token",
    reqBody,
    {
      accept: MediaTypes.ApplicationJson,
      "content-type": "application/x-www-form-urlencoded",
    }
  );
  const body = await resp.readBody();

  if (resp.message.statusCode !== 200) {
    const httpCode = resp.message.statusCode ?? "N/A";
    const httpMsg = resp.message.statusMessage ?? "N/A";
    const { errorCode, errorDesc } = parseError(body);
    core.error(
      `IAM token request error: status=${httpCode}; statusMsg=${httpMsg};` +
        ` errorCode=${errorCode}; errorDesc=${errorDesc}`
    );
    throw new Error(`IAM token request error (code ${httpCode}: ${errorDesc}`);
  }

  return parseResponse(body);
}

/**
 * @param {string} body
 * @returns {{ errorCode: string, errorDesc: string }}
 */
function parseError(body) {
  try {
    const data = validateError(JSON.parse(body));
    return { errorCode: data.error, errorDesc: data.error_description };
  } catch (err) {
    console.log("Error body is invalid:", body);
    return {
      errorCode: "parse_error",
      errorDesc: `Failed to parse error body: ${err}`,
    };
  }
}

/*
2025-04-03
Yandex error schema (status != 200):
{"error_description": "...", "error": "invalid_request"}
*/

const validateError = bt.object({
  error: bt.string(),
  error_description: bt.string(),
});

/**
 * @param {string} body
 * @returns {TokenResponse}
 */
function parseResponse(body) {
  try {
    const data = validateResponse(JSON.parse(body));
    return { token: data.access_token, expiresIn: data.expires_in };
  } catch (err) {
    throw new Error(`Failed to parse response: ${err}`);
  }
}

/*
2025-04-03
Yandex success schema:
{"access_token": "...", "token_type": "Bearer", "expires_in": 43200}
*/

const validateResponse = bt.object({
  access_token: bt.string(),
  expires_in: bt.number(),
});
