from rest_framework.views import exception_handler
from rest_framework import status


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        data = {}
        if hasattr(exc, 'detail'):
            if isinstance(exc.detail, dict):
                data['error'] = 'Validation failed.'
                data['field_errors'] = {
                    k: [str(e) for e in v] if isinstance(v, list) else [str(v)]
                    for k, v in exc.detail.items()
                }
            elif isinstance(exc.detail, list):
                data['error'] = ' '.join(str(e) for e in exc.detail)
            else:
                data['error'] = str(exc.detail)
        else:
            data['error'] = str(exc)
        response.data = data
    return response
