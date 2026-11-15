/**
 * Any value representable in JSON text, used only for documents with no fixed schema.
 */
export type JsonValue = string | number | boolean | null | ReadonlyArray<JsonValue> | JsonObject;

/**
 * A JSON object whose members are arbitrary JSON values.
 */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
