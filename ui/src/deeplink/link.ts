interface LinkParams {
    dapp_encryption_public_key: string, host: string, redirect_link: string, cluster: string
}

interface PayloadLinkParams {
    dapp_encryption_public_key: string
    nonce: string
    payload: string
    redirect_link: string
}

export function generateLink(method: string, linkParams: LinkParams, session?: string) {
    const params = new URLSearchParams({
        dapp_encryption_public_key: linkParams.dapp_encryption_public_key,
        redirect_link: linkParams.redirect_link,
        app_url: linkParams.host,
        cluster: linkParams.cluster,
        // TODO support cluster
    })
    return `phantom://v1/${method}?${params.toString()}`
}

export function generatePayloadLink(method: string, linkPayloadParams: PayloadLinkParams) {
    const params = new URLSearchParams({
        dapp_encryption_public_key: linkPayloadParams.dapp_encryption_public_key,
        redirect_link: linkPayloadParams.redirect_link,
        nonce: linkPayloadParams.nonce,
        payload: linkPayloadParams.payload,
        // TODO support cluster
    })
    return `https://phantom.app/ul/v1/${method}?${params.toString()}`
}
