import { sign } from "../../src/sumsub/sign.js";

describe("sign", () => {
    it("produces expected HMAC for Go reference vector (no body)", () => {
        const secret = new TextEncoder().encode("SoMe_SeCrEt_KeY");
        const timestamp = "1607551635";
        const method = "POST";
        const uri = "/resources/accessTokens?userId=cfd20712-24a2-4c7d-9ab0-146f3c142335&levelName=basic-kyc-level&ttlInSecs=600";
        const body: Uint8Array | null = null;
        const got = sign(secret, timestamp, method, uri, body);
        expect(got).toBe(
            "15cc96be3e65ed8805f374db7f4c49c5723ae2a20eea3159cf0ab7c3badc3ad0"
        );
    });
});
