// Login Submit Logic
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        // Update button UI
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'Memproses...';
        btn.disabled = true;
        btn.style.opacity = '0.8';

        fetch('api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    localStorage.setItem('user', JSON.stringify(data.data));
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Login Berhasil',
                        text: 'Selamat datang kembali di LogistiKita!',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        // Redirect based on role
                        if (data.data.role === 'admin') window.location.href = 'admin';
                        else if (data.data.role === 'kurir') window.location.href = 'kurir';
                        else window.location.href = 'dashboard';
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Login Gagal',
                        text: data.message
                    });
                    btn.innerText = originalText;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            })
            .catch(err => {
                Swal.fire({
                    icon: 'error',
                    title: 'Kesalahan',
                    text: 'Gagal terhubung ke server.'
                });
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.opacity = '1';
            });
    });
}

// Register Submit Logic
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        // Update button UI
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'Memproses...';
        btn.disabled = true;
        btn.style.opacity = '0.8';

        fetch('api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role: 'user' }) // Default register as user
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Registrasi Berhasil',
                        text: 'Akun Anda telah dibuat. Silakan login.',
                        confirmButtonText: 'Login Sekarang'
                    }).then(() => {
                        window.location.href = 'login';
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Registrasi Gagal',
                        text: data.message
                    });
                    btn.innerText = originalText;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            })
            .catch(err => {
                Swal.fire({
                    icon: 'error',
                    title: 'Kesalahan',
                    text: 'Gagal terhubung ke server.'
                });
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.opacity = '1';
            });
    });
}
