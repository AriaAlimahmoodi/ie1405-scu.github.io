export function guard(input) {
    let url;

    try {
        url = new URL(input);
    } catch {
        return { ok: false };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false };
    }

    if (url.username !== '' || url.password !== '') {
        return { ok: false };
    }

    if (url.origin !== 'http://scu.test' &&
        url.origin !== 'https://scu.test') {
        return { ok: false };
    }

    return {
        ok: true,
        url: url.href
    };
}
