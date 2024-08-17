const API_HOST = 'http://127.0.0.1:8000';

export const API_ENDPOINTS = {
  REGISTER: `${API_HOST}/api/users/users/register/`,
  LOGIN: `${API_HOST}/api/token/`,
  REFRESH_TOKEN: `${API_HOST}/api/token/update/`,
};

export default API_ENDPOINTS;