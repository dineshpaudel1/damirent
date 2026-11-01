"""
Khalti ePay v2 integration.
Docs: https://docs.khalti.com/khalti-epay/api/

Sandbox base URL: https://a.khalti.com/api/v2/epayment/
"""
import json
import urllib.error
import urllib.request

from django.conf import settings

KHALTI_BASE = 'https://a.khalti.com/api/v2/epayment'


def _post(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Authorization': f'Key {settings.KHALTI_SECRET_KEY}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))


def initiate(payment_id: str, amount_npr: int, order_name: str,
             customer_name: str, customer_email: str, return_url: str) -> dict:
    """
    Initiate a Khalti payment.
    Returns {'pidx': ..., 'payment_url': ...} on success.
    """
    return _post(f'{KHALTI_BASE}/initiate/', {
        'return_url': return_url,
        'website_url': return_url.split('/api/')[0],
        'amount': amount_npr * 100,          # NPR → paisa
        'purchase_order_id': str(payment_id),
        'purchase_order_name': order_name,
        'customer_info': {
            'name': customer_name,
            'email': customer_email,
        },
    })


def lookup(pidx: str) -> dict:
    """
    Verify payment status with Khalti.
    Returns full lookup response including 'status' and 'transaction_id'.
    """
    return _post(f'{KHALTI_BASE}/lookup/', {'pidx': pidx})


def refund(pidx: str, amount_npr: int) -> dict:
    """
    Initiate a full or partial refund via Khalti.

    Khalti refund endpoint: POST https://a.khalti.com/api/v2/epayment/refund/
    Body: { "pidx": "<payment_pidx>", "amount": <paisa> }
    amount is in paisa (1 NPR = 100 paisa).

    On success Khalti returns:
        { "pidx": "...", "refund_id": "...", "status": "Refunded" }
    On failure raises urllib.error.HTTPError with error body.
    """
    return _post(f'{KHALTI_BASE}/refund/', {
        'pidx': pidx,
        'amount': amount_npr * 100,   # NPR → paisa
    })
