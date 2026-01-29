import { Config } from '../lib/config';
import { createSequencer } from '../lib/sequencer';

const seq = createSequencer();

export const buildPrompt = (): string => {
  const shouldCommit = Config.get('shouldCommit');
  const validatorCommands = Config.get('validatorCommands');

  let prompt = '';

  prompt += `${seq.next()}. Find the highest-priority feature to work on and work only on that feature. `;
  prompt +=
    'This should be the one that YOU decide has the highest priority - not necessarily the first one in the list. ';
  if (validatorCommands.length > 0) {
    prompt += `${seq.next()}. Use these commands to validate the work: ${validatorCommands.join(', ')}. `;
  }
  prompt += `${seq.next()}. Update the PRD with the work that was done. `;
  prompt += `${seq.next()}. Append your progress to the .ody/progress.txt file. `;
  prompt += 'Use this to leave a note for the next person working on the codebase. ';
  if (shouldCommit) {
    prompt += `${seq.next()}. Make a git commit of that feature. `;
  }
  prompt += 'ONLY WORK ON A SINGLE FEATURE. ';
  prompt +=
    'If, while implementing the feature, you notice the PRD is complete, output <bark>COMPLETE</bark>.';
  prompt += 'If you cannot find a PRD file, output <bark>COMPLETE</bark>.';

  return prompt.trim();
};
