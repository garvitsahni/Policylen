import unittest
from unittest import mock

from . import main

def _ok(answer='{"insurer_name": "X"}'):
    return {"answer": answer, "grounded": False, "cited_clause_id": None, "raw_error": None}

def _err(message):
    return {"answer": None, "grounded": False, "cited_clause_id": None, "raw_error": message}


class ExtractionChainTests(unittest.TestCase):

    def test_gemini_is_primary_and_used_when_successful(self):
        with mock.patch.object(main, 'call_gemini', return_value=_ok()) as g, \
             mock.patch.object(main, 'call_openrouter', side_effect=AssertionError('openrouter should not be called')) as o, \
             mock.patch.object(main, 'call_nvidia', side_effect=AssertionError('nvidia should not be called')) as n, \
             mock.patch.object(main, 'call_groq', side_effect=AssertionError('groq should not be called')) as gr:
            result = main.call_llm('sys', 'user', extraction=True,
                                   max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertEqual(result['raw_error'], None)
        self.assertEqual(result['answer'], '{"insurer_name": "X"}')
        g.assert_called_once()
        self.assertFalse(o.called)
        self.assertFalse(n.called)
        self.assertFalse(gr.called)

    def test_openrouter_is_fallback_when_gemini_fails(self):
        with mock.patch.object(main, 'call_gemini', return_value=_err('Gemini quota exhausted')) as g, \
             mock.patch.object(main, 'call_openrouter', return_value=_ok()) as o:
            result = main.call_llm('sys', 'user', extraction=True, max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertEqual(result['raw_error'], None)
        self.assertEqual(result['answer'], '{"insurer_name": "X"}')
        g.assert_called_once()
        o.assert_called_once()

    def test_all_providers_failed_surfaces_combined_error(self):
        with mock.patch.object(main, 'call_gemini', return_value=_err('gemini down')), \
             mock.patch.object(main, 'call_openrouter', return_value=_err('or down')), \
             mock.patch.object(main, 'call_nvidia', return_value=_err('nv down')), \
             mock.patch.object(main, 'groq_extract_chunked', return_value=_err('groq down')):
            result = main.call_llm('sys', 'user', extraction=True, max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertIsNone(result['answer'])
        self.assertIn('gemini', result['raw_error'])
        self.assertIn('groq', result['raw_error'])

    def test_gemini_extraction_uses_expanded_token_budget(self):
        with mock.patch.object(main, 'call_gemini', return_value=_ok()) as g, \
             mock.patch.object(main, 'call_openrouter', return_value=_err('should not be called')):
            main.call_llm('sys', 'user', extraction=True, max_tokens=8192, temperature=0.1,
                          response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        _, kwargs = g.call_args
        self.assertEqual(kwargs['max_tokens'], main.GEMINI_EXTRACTION_MAX_TOKENS)

    def test_gemini_chat_keeps_normal_token_budget(self):
        with mock.patch.object(main, 'call_openrouter', return_value=_err('or down')), \
             mock.patch.object(main, 'call_groq', return_value=_err('groq down')), \
             mock.patch.object(main, 'call_nvidia', return_value=_err('nv down')), \
             mock.patch.object(main, 'call_gemini', return_value=_ok()) as g:
            main.call_llm('sys', 'user', chat=True, max_tokens=1024, temperature=0.1,
                          response_schema=None, response_json=False)
        _, kwargs = g.call_args
        self.assertEqual(kwargs['max_tokens'], 1024)


class GeminiAuthFailFastTests(unittest.TestCase):

    def _make_client(self, exc):
        client = mock.Mock()
        client.models.generate_content.side_effect = exc
        return client

    def test_auth_error_returns_immediately_without_retry(self):
        client = self._make_client(RuntimeError('API key not valid. Please pass a valid API key. (401)'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertIn('API key not valid', result['raw_error'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_permission_denied_returns_immediately_without_retry(self):
        client = self._make_client(RuntimeError('403 PERMISSION_DENIED'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_quota_error_still_returns_immediately(self):
        client = self._make_client(RuntimeError('429 RESOURCE_EXHAUSTED'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertIn('quota exhausted', result['raw_error'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_transient_error_still_retries(self):
        client = self._make_client(RuntimeError('503 Service Unavailable'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertEqual(client.models.generate_content.call_count, main.MAX_RETRIES)
        sleep.assert_called()

    def test_gemini_disables_thinking_by_default(self):
        response = mock.Mock()
        response.text = '{"ok": true}'
        response.prompt_feedback = None
        client = mock.Mock()
        client.models.generate_content.return_value = response
        with mock.patch.object(main, '_get_gemini_client', return_value=client):
            main.call_gemini('sys', 'user')
        call_kwargs = client.models.generate_content.call_args.kwargs
        config = call_kwargs['config']
        self.assertEqual(config.thinking_config.thinking_budget, main.GEMINI_THINKING_BUDGET)


class HttpSessionTests(unittest.TestCase):

    def test_call_openai_compatible_posts_via_shared_session(self):
        response = mock.Mock(status_code=200)
        response.json.return_value = {"choices": [{"message": {"content": "ok"}}]}
        session = mock.Mock()
        session.post.return_value = response
        with mock.patch.object(main, '_HTTP_SESSION', session) as s, \
             mock.patch.object(main.requests, 'post', side_effect=AssertionError('bare requests.post must not be used')):
            result = main.call_openai_compatible(
                base_url='https://example.com/v1', api_key='sk-test',
                provider_label='Test', system_prompt='sys', user_prompt='user',
                model='m', max_tokens=10, temperature=0.1, response_json=False)
        self.assertEqual(result['answer'], 'ok')
        s.post.assert_called_once()
        self.assertIn('/chat/completions', s.post.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
