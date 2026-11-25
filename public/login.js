const error = new URLSearchParams(location.search).get('error');
if (error) document.querySelector('#login-error').textContent = error === 'limit' ? 'Çok fazla deneme yapıldı. 10 dakika sonra tekrar dene.' : 'Kullanıcı adı veya parola hatalı.';
