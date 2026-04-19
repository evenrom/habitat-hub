export const API_URL = 'https://script.google.com/macros/s/AKfycbzdEpbxigPkTkrYl-bAhM7gaVfQKOJL1NTOusEc95uIAdahAFpM8Npanb7fnJ5vgKjY/exec';
export const PASSCODE = 'SA8RG';

export async function fetchAPI(action, payload = {}) {
    const body = {
        passcode: PASSCODE,
        action: action,
        ...payload
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        alert(`API Error: ${error.message || 'An error occurred during the API call.'}`);
        throw error; // Propagate error
    }
}
