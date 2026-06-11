const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');

// Challenge 1: Unit Testing - /api/courses
describe('Courses API (/api/courses)', () => {
  let courseId;

  it('should get all courses', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
  });

  it('should create a new course', async () => {
    const res = await request(app)
      .post('/api/courses')
      .send({ name: 'Mocha Testing', duration: '1 week' });
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('name', 'Mocha Testing');
    courseId = res.body.id;
  });

  it('should return 400 if name is missing', async () => {
    const res = await request(app)
      .post('/api/courses')
      .send({ name: '' });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error', 'Course name is required');
  });

  it('should update a course', async () => {
    const res = await request(app)
      .put(`/api/courses/${courseId}`)
      .send({ duration: '2 weeks' });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('duration', '2 weeks');
  });

  it('should delete a course', async () => {
    const res = await request(app).delete(`/api/courses/${courseId}`);
    expect(res.status).to.equal(200);
  });
});

// Challenge 2: Integration Testing - /api/users
describe('Users API (/api/users)', () => {
  it('should return a list of users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
  });

  it('should not return password field', async () => {
    const res = await request(app).get('/api/users');
    if (res.body.length > 0) {
      expect(res.body[0]).to.not.have.property('password');
    }
  });
});
