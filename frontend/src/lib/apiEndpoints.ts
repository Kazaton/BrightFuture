const API_HOST = 'http://127.0.0.1:8000';

export const API_ENDPOINTS = {
  REGISTER: `${API_HOST}/api/users/users/register/`,
  LOGIN: `${API_HOST}/api/token/`,
  REFRESH_TOKEN: `${API_HOST}/api/token/update/`,
  MY_PROFILE: `${API_HOST}/api/users/profile/`,
  TOP_USERS: `${API_HOST}/api/users/top-users/`,
};

export default API_ENDPOINTS;