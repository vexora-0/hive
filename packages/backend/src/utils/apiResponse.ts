export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T;
  cursor: string | null;
}

export function success<T>(data: T, message?: string): SuccessResponse<T> {
  const response: SuccessResponse<T> = { success: true, data };
  if (message) {
    response.message = message;
  }
  return response;
}

export function error(
  message: string,
  code?: string,
): ErrorResponse {
  const response: ErrorResponse = { success: false, message };
  if (code) {
    response.code = code;
  }
  return response;
}

export function paginated<T>(
  data: T,
  cursor: string | null,
): PaginatedResponse<T> {
  return { success: true, data, cursor };
}
