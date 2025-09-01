document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.classList.add('d-none');
        successMessage.classList.add('d-none');

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                successMessage.textContent = data.message + ' Вы будете перенаправлены на страницу входа.';
                successMessage.classList.remove('d-none');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            } else {
                errorMessage.textContent = data.message || 'Произошла ошибка.';
                errorMessage.classList.remove('d-none');
            }
        } catch (error) {
            console.error('Registration error:', error);
            errorMessage.textContent = 'Не удалось подключиться к серверу.';
            errorMessage.classList.remove('d-none');
        }
    });
});