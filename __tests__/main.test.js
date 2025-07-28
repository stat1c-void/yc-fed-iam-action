import { afterAll, afterEach, describe, expect, it, jest } from "@jest/globals";
import nock from "nock";

const originalEnv = { ...process.env };

/**
 * Stub ID token (HS256). Needs to be a decodable JWT because of logging.
 *
 * ```
 * {
 *    "iss": "stub-id-token-iss",
 *    "iat": 1753697118,
 *    "exp": 1785233120,
 *    "aud": "stub-id-token-aud",
 *    "sub": "stub-id-token-sub"
 * }
 * ```
 */
const stubIdToken =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdHViLWlkLXRva2VuLWlzcyIsImlhdCI6MTc1MzY5NzExOCwiZXhwIjoxNzg1MjMzMTIwLCJhdWQiOiJzdHViLWlkLXRva2VuLWF1ZCIsInN1YiI6InN0dWItaWQtdG9rZW4tc3ViIn0.peQeF30C3mtRwHO4j1HCH_i9qMJetmSE_YifnOqii_A";

/**
 * Stub Yandex Cloud token (HS256). Needs to be a decodable JWT because of logging.
 *
 * ```
 * {
 *    "iss": "stub-yc-token-iss",
 *    "iat": 1753697118,
 *    "exp": 1785233120,
 *    "aud": "stub-yc-token-aud",
 *    "sub": "stub-yc-token-sub"
 * }
 * ```
 */
const stubYCToken =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdHViLXljLXRva2VuLWlzcyIsImlhdCI6MTc1MzY5NzExOCwiZXhwIjoxNzg1MjMzMTIwLCJhdWQiOiJzdHViLXljLXRva2VuLWF1ZCIsInN1YiI6InN0dWIteWMtdG9rZW4tc3ViIn0.hCSqPuIrePiJhx-bIeZyuPYo0QLUgbqew1M17qWdma0";

jest.unstable_mockModule("@actions/core", () => {
  /** @type {typeof import("@actions/core")} */
  const orgModule = jest.requireActual("@actions/core");
  return {
    __esModule: true,
    getInput: orgModule.getInput,
    isDebug: jest.fn().mockReturnValue(false),
    error: jest.fn(),
    debug: jest.fn(),
    setFailed: jest.fn(),
    getIDToken: jest.fn(),
    setOutput: jest.fn(),
    setSecret: jest.fn(),
  };
});
const core = await import("@actions/core");

nock.disableNetConnect();

/**
 * @param {string} serviceAccId
 * @param {string} idToken
 */
function nockStdRequest(serviceAccId, idToken) {
  return nock("https://auth.yandex.cloud", {
    reqheaders: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
  }).post(
    "/oauth/token",
    (body) => body.audience === serviceAccId && body.subject_token === idToken
  );
}

afterEach(() => {
  process.env = { ...originalEnv };
  jest.resetAllMocks();
});

afterAll(() => {
  // from nock readme (avoid memory issues)
  // https://github.com/nock/nock?tab=readme-ov-file#memory-issues-with-jest
  nock.restore();
});

const main = (await import("../src/main.js")).default;

it("works properly in happy path", async () => {
  process.env["INPUT_SERVICE-ACCOUNT"] = "stub-sa";
  core.getIDToken.mockReturnValueOnce(stubIdToken);
  core.isDebug.mockReturnValue(true);

  const nockCtx = nockStdRequest("stub-sa", stubIdToken).reply(200, {
    access_token: stubYCToken,
    token_type: "Bearer",
    expires_in: 500,
  });

  await main();

  expect(core.setFailed).not.toHaveBeenCalled();
  expect(core.setOutput).toHaveBeenNthCalledWith(1, "token", stubYCToken);
  expect(core.setOutput).toHaveBeenNthCalledWith(2, "expires-in", 500);
  expect(core.setSecret).toHaveBeenCalledWith(stubYCToken);
  nockCtx.done();
});

it("handles failed request", async () => {
  process.env["INPUT_SERVICE-ACCOUNT"] = "stub-sa";
  core.getIDToken.mockReturnValueOnce("stub-id-token");
  const nockCtx = nockStdRequest("stub-sa", "stub-id-token").replyWithError(
    "stub-network-error"
  );

  await main();

  expect(core.setFailed).toHaveBeenCalled();
  expect(core.setFailed.mock.lastCall[0]).toMatch(/stub-network-error/);
  nockCtx.done();
});

describe.each(["invalid non-json error", { invalid: "schema" }])(
  "parametrized: malformed error reply",
  (errData) => {
    it("handles malformed error reply", async () => {
      process.env["INPUT_SERVICE-ACCOUNT"] = "stub-sa";
      core.getIDToken.mockReturnValueOnce("stub-id-token");
      const nockCtx = nockStdRequest("stub-sa", "stub-id-token").reply(
        400,
        errData
      );

      await main();

      expect(core.error).toHaveBeenCalled();
      expect(core.error.mock.lastCall[0]).toMatch(
        /IAM token request error: status=400.*errorCode=malformed_error/
      );
      expect(core.setFailed).toHaveBeenCalled();
      expect(core.setFailed.mock.lastCall[0]).toMatch(
        /IAM token request error \(code 400.*Failed to parse error body/
      );
      nockCtx.done();
    });
  }
);

it("handles error reply", async () => {
  process.env["INPUT_SERVICE-ACCOUNT"] = "stub-sa";
  core.getIDToken.mockReturnValueOnce("stub-id-token");
  const nockCtx = nockStdRequest("stub-sa", "stub-id-token").reply(400, {
    error: "stub-err-code",
    error_description: "stub-err-desc",
  });

  await main();

  expect(core.error).toHaveBeenCalled();
  expect(core.error.mock.lastCall[0]).toMatch(
    /IAM token request error: status=400.*errorCode=stub-err-code.*errorDesc=stub-err-desc/
  );
  expect(core.setFailed).toHaveBeenCalled();
  expect(core.setFailed.mock.lastCall[0]).toMatch(
    /IAM token request error \(code 400\): stub-err-desc/
  );
  nockCtx.done();
});

describe.each([{ foo: "bar" }, { access_token: "123" }, { expires_in: 321 }])(
  "parametrized: malformed success reply",
  (replyData) => {
    it("handles malformed success reply", async () => {
      process.env["INPUT_SERVICE-ACCOUNT"] = "stub-sa";
      core.getIDToken.mockReturnValueOnce("stub-id-token");
      const nockCtx = nockStdRequest("stub-sa", "stub-id-token").reply(
        200,
        replyData
      );

      await main();

      expect(core.setFailed).toHaveBeenCalled();
      expect(core.setFailed.mock.lastCall[0]).toMatch(
        /Failed to parse response/
      );
      nockCtx.done();
    });
  }
);
