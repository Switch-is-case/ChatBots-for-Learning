document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.classList.add('d-none'); // Скрыть предыдущие ошибки

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // В случае успеха перенаправляем на главную страницу
                window.location.href = '/index.html';
            } else {
                // Показываем сообщение об ошибке
                errorMessage.textContent = data.message || 'Произошла ошибка.';
                errorMessage.classList.remove('d-none');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'Не удалось подключиться к серверу.';
            errorMessage.classList.remove('d-none');
        }
    });
});