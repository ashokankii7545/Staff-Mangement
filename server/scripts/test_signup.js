fetch('http://localhost:8080/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `mutation { signup(input: {name: "test", email: "test5@test.com", password: "testPassword1", avatarBase64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP"}) { success message } }`
  })
}).then(r => r.json()).then(console.log).catch(console.error);
