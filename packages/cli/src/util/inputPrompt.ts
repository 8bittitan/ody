const PLACEHOLDER_VALIDATOR_COMMANDS = [
  'bun run lint',
  'make test',
  'npm run typecheck',
  'pylint',
  'go test ./...',
  'rubocop --lint',
];

export const getRandomValidatorPlaceholder = () => {
  const index = Math.floor(Math.random() * PLACEHOLDER_VALIDATOR_COMMANDS.length);
  return PLACEHOLDER_VALIDATOR_COMMANDS[index] ?? PLACEHOLDER_VALIDATOR_COMMANDS[0]!;
};
