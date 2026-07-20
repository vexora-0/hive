/**
 * Pull a user-facing message out of an unknown thrown value.
 *
 * The API returns genuinely useful text for authorisation, validation and
 * conflict failures — "This parent is already mapped to this student" tells
 * someone what to do next in a way "Something went wrong" never will. So the
 * server message is preferred whenever there is one, and `fallback` covers the
 * cases where there is not: a network drop, or a thrown non-Error.
 *
 * ```ts
 * onError: (e) => toast.error(apiErrorMessage(e, 'Could not add student.')),
 * ```
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
