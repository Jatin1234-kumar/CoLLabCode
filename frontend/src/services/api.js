import apiClient from './apiClient.js';

// Auth endpoints
export const registerUser = (username, email, password, displayName) =>
  apiClient.post('/auth/register', { username, email, password, displayName });

export const loginUser = (email, password) =>
  apiClient.post('/auth/login', { email, password });

export const getCurrentUser = () => apiClient.get('/auth/me');

// Room endpoints
export const createRoom = (name, language) =>
  apiClient.post('/rooms', { name, language });

export const getAllRooms = () => apiClient.get('/rooms');

export const getRoom = (roomId) => apiClient.get(`/rooms/${roomId}`);

export const deleteRoom = (roomId) => apiClient.delete(`/rooms/${roomId}`);

export const getRoomVersions = (roomId) => apiClient.get(`/rooms/${roomId}/versions`);

export const leaveRoom = (roomId) => apiClient.post(`/rooms/${roomId}/leave`);

export const runCode = (roomId, code, language) =>
  apiClient.post(`/rooms/${roomId}/run`, { code, language });

// Join request endpoints
export const requestJoinRoom = (roomId, requestedRole) =>
  apiClient.post(`/rooms/${roomId}/join-request`, { requestedRole });

export const approveJoinRequest = (roomId, requestId) =>
  apiClient.post(`/rooms/${roomId}/join-request/${requestId}/approve`);

export const rejectJoinRequest = (roomId, requestId) =>
  apiClient.post(`/rooms/${roomId}/join-request/${requestId}/reject`);

// Participant endpoints
export const updateParticipantRole = (roomId, userId, newRole) =>
  apiClient.patch(`/rooms/${roomId}/participants/${userId}/role`, { newRole });

export const transferOwnership = (roomId, newOwnerId) =>
  apiClient.post(`/rooms/${roomId}/transfer-ownership`, { newOwnerId });
