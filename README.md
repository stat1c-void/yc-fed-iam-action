# Get Yandex Cloud IAM token through federation

Use this action to get a Yandex Cloud service account IAM token through
[Workload Identity Federation](https://yandex.cloud/en/docs/iam/operations/wlif/setup-wlif). This allows workflows to perform actions on Yandex Cloud
resources on behalf of service accounts without using authorized keys.

## How it works, in short
- this action requests workflow's ID Token - an OpenID Connect JWT, signed by GitHub
- then it exchanges the ID Token for Yandex Cloud service account IAM token
  * this requires that a trust is set up on the Yandex Cloud side

GitHub documentation: [OpenID Connect](https://docs.github.com/en/actions/concepts/security/openid-connect)

## Yandex Cloud settings
Yandex Cloud would need the following federation settings (as of July 2025):

* Issuer (iss): `https://token.actions.githubusercontent.com`
* Audience (aud): `https://github.com/<org-name>`
* JWKS URL: `https://token.actions.githubusercontent.com/.well-known/jwks`
* Subject (sub): `repo:<org-name>/<repo-name>:ref:refs/heads/main` (exampe)

It's possible to customize `aud` value using action input. It's also possible
to customize `sub` claim - see below.

## Some limitations
As of July 2025, the `sub` matching does not use patterns of any kind (i.e.
glob or regex), so it's only possible to match static, pre-determined `sub`
values.

However, it is possible to change `sub` claim (as of July 2025 - only possible
through GitHub REST API):
[Customizing the subject claims for an organization or repository](https://docs.github.com/en/actions/reference/security/oidc#customizing-the-subject-claims-for-an-organization-or-repository)

## Inputs and outputs
Inputs:
* `service-account` (**required**) - Yandex Cloud service account ID
* `audience` (optional) - custom `aud` claim

Outpus:
* `token` - token value
* `expires-in` - remaining token time-to-live in seconds

## Usage example
Non-essential entries are skipped:

```yaml
jobs:
  example-job:
    permissions:
      contents: read
      id-token: write # required for getting ID token

    steps:
      - name: Get Yandex IAM token
        id: ya_iam_token
        uses: stat1c-void/yc-fed-iam-action@main
        with:
          service-account: <some-account-id>

      - name: Docker login
        uses: docker/login-action@v3
        with:
          registry: cr.yandex
          username: iam
          password: ${{ steps.ya_iam_token.outputs.token }}
```

## I'm getting an error about ACTIONS_ID_TOKEN_REQUEST_URL
If you are getting an error like `Unable to get ACTIONS_ID_TOKEN_REQUEST_URL
env variable`, check that your job or workflow has `id-token: write` permission -
[it is required](https://docs.github.com/en/actions/reference/security/oidc#workflow-permissions-for-the-requesting-the-oidc-token).
