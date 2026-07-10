# Agent Notes

- Never expose WHOOP, Hevy or MyFitnessPal credentials to browser code.
- Keep provider-specific code behind adapter interfaces in `packages/shared`.
- Dashboard components must read normalized application data, not provider payloads.
- Raw provider responses should not be logged.
- MyFitnessPal cookie material must be treated as secret and collected only by the Python worker path.
