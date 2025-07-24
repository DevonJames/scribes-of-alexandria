// account.js

// Ensure user is authenticated when the page loads
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['jwt'], function(result) {
        const token = result.jwt;

        if (!token) {
            alert('User not authenticated. Redirecting to login page.');
            window.location.href = 'login.html'; // Redirect to login if not authenticated
        } else {
            // Fetch account details using the token
            fetchAccountDetails(token);
        }
    });
});

const backendURL = 'https://api.oip.onl';
// Fetch account details from backend
function fetchAccountDetails(token) {
    fetch(`${backendURL}/api/user`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        // Store user identifier in local storage
        chrome.storage.local.set({ userId: data.userId });  // Assuming `userId` is unique and available in the response
        document.getElementById('user-email').textContent = data.email;
        
        document.getElementById('subscription-status').textContent = data.subscriptionStatus;
        document.getElementById('payment-method').textContent = data.paymentMethod;
    })
    .catch(error => {
        console.error('Error fetching account details:', error);
        alert('Error loading account details.');
    });
}

document.getElementById('join-waitlist-btn').addEventListener('click', () => {
    const email = document.getElementById('waitlist-email').value;

    if (!email) {
        document.getElementById('waitlist-message').textContent = 'Please enter a valid email.';
        return;
    }

    fetch(`${backendURL}/api/user/joinWaitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('waitlist-message').textContent = data.message || data.error;
    })
    .catch(error => {
        console.error('Error joining waitlist:', error);
        document.getElementById('waitlist-message').textContent = 'An error occurred. Please try again later.';
    });
});

// Logic to update email
document.getElementById('change-email-btn').addEventListener('click', () => {
    const newEmail = prompt('Enter your new email address:');
    
    if (newEmail) {
        chrome.storage.sync.get(['jwt'], function(result) {
            const token = result.jwt;

            fetch(`${backendURL}/api/user/update-email`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: newEmail })
            })
            .then(response => {
                if (response.ok) {
                    alert('Email updated successfully.');
                    document.getElementById('user-email').textContent = newEmail;
                } else {
                    alert('Failed to update email.');
                }
            })
            .catch(error => {
                console.error('Error updating email:', error);
                alert('Error updating email.');
            });
        });
    }
});

// Logic to update payment method
document.getElementById('update-payment-btn').addEventListener('click', () => {
    const paymentMethod = prompt('Enter your new payment method (e.g., Visa **** 1234):');
    
    if (paymentMethod) {
        chrome.storage.sync.get(['jwt'], function(result) {
            const token = result.jwt;

            fetch(`${backendURL}/api/user/update-payment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ paymentMethod })
            })
            .then(response => {
                if (response.ok) {
                    alert('Payment method updated successfully.');
                    document.getElementById('payment-method').textContent = paymentMethod;
                } else {
                    alert('Failed to update payment method.');
                }
            })
            .catch(error => {
                console.error('Error updating payment method:', error);
                alert('Error updating payment method.');
            });
        });
    }
});

// Logic to handle logout
document.getElementById('logout-btn').addEventListener('click', () => {
    chrome.storage.sync.remove('jwt', function() {
        alert('You have been logged out.');
        window.location.href = 'login.html'; // Redirect to login after logout
    });
});

// JWT Token Handling
function getJwtToken(callback) {
    chrome.storage.sync.get(['jwt'], function(result) {
        callback(result.jwt);
    });
}

function saveJwtToken(token) {
    chrome.storage.sync.set({ 'jwt': token }, function() {
        console.log('JWT token saved successfully.');
    });
}

function removeJwtToken() {
    chrome.storage.sync.remove('jwt', function() {
        console.log('JWT token removed successfully.');
    });
}