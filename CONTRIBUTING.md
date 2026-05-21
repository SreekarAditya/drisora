# Contributing

Thanks for helping improve Drisora Backend.

## Reporting Issues

Open an issue with:

- a clear title
- input type, model settings, and environment details
- expected behavior
- actual behavior
- logs or a minimal reproducible example when possible

Do not attach secrets, private survey media, credentials, bucket names, API keys, or proprietary standards text.

## Pull Requests

1. Fork the repository and create a focused branch.
2. Keep changes scoped to the backend pipeline.
3. Add or update tests for behavior changes.
4. Run the worker test suite:

```bash
python -m unittest discover -s worker/tests -v
```

5. Open a PR describing the change, verification performed, and any remaining limitations.

## License Agreement

By submitting a pull request or other contribution, you agree that your contribution is licensed under AGPL-3.0 for inclusion in Drisora Backend.
