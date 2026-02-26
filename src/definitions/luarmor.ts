import type { TypeEnvironment } from '@typings/environment';
import { defineSymbol } from '@typings/environment';
import type { DocComment } from '@typings/parser';
import {
  AnyType,
  BooleanType,
  NilType,
  NumberType,
  StringType,
  createFunctionType,
  createTableType,
} from '@typings/types';

const doc = (description: string): DocComment => ({
  description,
  'params': [],
  'returns': [],
  'type': undefined,
  'class': undefined,
  'fields': [],
  'deprecated': undefined,
  'raw': description,
});

/** Adds Luarmor (LRM) globals to the environment. */
export const addLuarmorGlobals = (env: TypeEnvironment): void => {
  defineSymbol(
    env,
    'script_key',
    StringType,
    'Global',
    false,
    doc('The script key used to execute the script, if one was provided.'),
  );

  defineSymbol(
    env,
    'LRM_IsUserPremium',
    BooleanType,
    'Global',
    false,
    doc(
      'A boolean indicating if the user is premium or not. Useful for FFA scripts (freemium). Ad Reward keys are considered premium since a key was used to execute the script.',
    ),
  );

  defineSymbol(
    env,
    'LRM_LinkedDiscordID',
    StringType,
    'Global',
    false,
    doc(
      'The linked Discord ID of the user. This is their ID, not username — you need to use an API to get their username.',
    ),
  );

  defineSymbol(env, 'LRM_ScriptName', StringType, 'Global', false, doc('The name of the current script.'));

  defineSymbol(
    env,
    'LRM_TotalExecutions',
    NumberType,
    'Global',
    false,
    doc('The total executions from this script_key. Will be 0 by default.'),
  );

  defineSymbol(
    env,
    'LRM_SecondsLeft',
    NumberType,
    'Global',
    false,
    doc(
      'The seconds left until expiry on this script_key from the time of execution. Will be math.huge if auth_expire is not set. Does not update automatically.',
    ),
  );

  defineSymbol(
    env,
    'LRM_UserNote',
    StringType,
    'Global',
    false,
    doc('The user note. Will be "Not specified" by default.'),
  );

  defineSymbol(
    env,
    'LRM_ScriptVersion',
    StringType,
    'Global',
    false,
    doc('The version of the script in the format x.x.x.x (e.g. 0.0.1.2).'),
  );

  defineSymbol(
    env,
    'LRM_INIT_SCRIPT',
    createFunctionType([{ 'name': 'f', 'type': createFunctionType([], NilType), 'optional': false }], AnyType, {
      'description':
        'Runs a piece of code before your script is executed. Accepts a constant function. Warning: You must yield somewhere (even a task.wait() at the end), otherwise script_key will read as nil.',
    }),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LRM_SEND_WEBHOOK',
    createFunctionType(
      [
        { 'name': 'url', 'type': StringType, 'optional': false },
        {
          'name': 'data',
          'type': createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }),
          'optional': false,
        },
      ],
      NilType,
      { 'description': 'Sends a webhook to the given Discord webhook URL with the given data.' },
    ),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LRM_SANITIZE',
    createFunctionType(
      [
        { 'name': 'value', 'type': AnyType, 'optional': false },
        { 'name': 'regex', 'type': StringType, 'optional': false },
      ],
      StringType,
      { 'description': 'Sanitizes the given value of the webhook body with the given regex pattern.' },
    ),
    'Global',
    false,
  );
};
