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
export const stubIdToken =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdHViLWlkLXRva2VuLWlzcyIsImlhdCI6MTc1MzY5NzExOCwiZXhwIjoxNzg1MjMzMTIwLCJhdWQiOiJzdHViLWlkLXRva2VuLWF1ZCIsInN1YiI6InN0dWItaWQtdG9rZW4tc3ViIn0.peQeF30C3mtRwHO4j1HCH_i9qMJetmSE_YifnOqii_A"; // gitleaks:allow

/**
 * Stub Yandex Cloud token. IRL not a JWT, so it's just a test string here.
 */
export const stubYCToken = "stub-yandex-iam-token";
