import { afterAll, afterEach, describe, expect, it, jest } from "@jest/globals";
import nock from "nock";

const originalEnv = { ...process.env };

jest.unstable_mockModule("@actions/core", () => {
  /** @type {typeof import("@actions/core")} */
  const orgModule = jest.requireActual("@actions/core");
  return {
    __esModule: true,
    getInput: orgModule.getInput,
    error: jest.fn(),
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
  core.getIDToken.mockReturnValueOnce("stub-id-token");

  const nockCtx = nockStdRequest("stub-sa", "stub-id-token").reply(200, {
    access_token: "stub-iam-token",
    token_type: "Bearer",
    expires_in: 500,
  });

  await main();

  expect(core.setFailed).not.toHaveBeenCalled();
  expect(core.setOutput).toHaveBeenNthCalledWith(1, "token", "stub-iam-token");
  expect(core.setOutput).toHaveBeenNthCalledWith(2, "expires-in", 500);
  expect(core.setSecret).toHaveBeenCalledWith("stub-iam-token");
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
