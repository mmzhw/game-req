import json
import sys

from pypasser.captcha import geetest


def main():
    request = json.load(sys.stdin)
    result = geetest.v4.solve(
        captcha_id=request["captchaId"],
        risk_type="auto",
        proxy=request.get("proxy") or None,
        attempts=2,
        timeout=30,
    )
    if not result.is_solved or not result.response_token:
        raise RuntimeError("GeeTest verification was not solved")
    payload = json.loads(result.response_token)
    required = {
        "captcha_id",
        "lot_number",
        "pass_token",
        "gen_time",
        "captcha_output",
    }
    if set(payload) < required:
        raise RuntimeError("GeeTest returned an incomplete verification result")
    json.dump({key: payload[key] for key in required}, sys.stdout)


if __name__ == "__main__":
    main()
