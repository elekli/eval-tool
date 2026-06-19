import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Single shared Ajv instance — compile-and-cache validators by schema reference.
const ajv = new Ajv({ allErrors: false });
addFormats(ajv);

const cache = new WeakMap<object, ReturnType<typeof ajv.compile>>();

function getValidator(schema: object): ReturnType<typeof ajv.compile> {
  let validate = cache.get(schema);
  if (!validate) {
    validate = ajv.compile(schema);
    cache.set(schema, validate);
  }
  return validate;
}

/**
 * Validate `args` against a JSON Schema object.
 * Fail-closed: `undefined` or `null` args always return false.
 */
export function validArguments(schema: object, args: unknown): boolean {
  if (args === undefined || args === null) return false;
  const validate = getValidator(schema);
  return validate(args) as boolean;
}
