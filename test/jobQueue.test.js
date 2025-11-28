const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('lib/jobQueue (mocked axios)', function() {
  this.timeout(5000);

  let jobQueue;
  let axiosPath;
  let origCacheEntry;

  before(() => {
    // mock axios by replacing its module in require cache before loading jobQueue
    axiosPath = require.resolve('axios');
    origCacheEntry = require.cache[axiosPath];
    require.cache[axiosPath] = { exports: { request: async () => ({ status: 200 }) } };
    jobQueue = require('../lib/jobQueue');
  });

  after(() => {
    // restore original axios cache entry
    if (origCacheEntry) require.cache[axiosPath] = origCacheEntry;
  });

  it('creates a job and persists a report using mocked axios', async () => {
    const tests = [{ url: 'http://example.com' }];
    const jobId = jobQueue.createJob(tests, { timeoutMs: 1000, concurrency: 1 });
    expect(jobId).to.be.a('string');

    // poll for completion (should be quick because mocked)
    let job = null;
    for (let i = 0; i < 20; i++) {
      job = jobQueue.getJob(jobId);
      if (job && job.status === 'done') break;
      await new Promise(r => setTimeout(r, 100));
    }
    expect(job).to.exist;
    expect(job.status).to.equal('done');
    expect(job.reportId).to.be.a('string');

    const report = jobQueue.getReport(job.reportId);
    expect(report).to.be.an('object');
    expect(report.results).to.be.an('array').with.lengthOf(1);
    expect(report.results[0]).to.have.property('actualStatus').that.satisfies(v => v === 200 || v === null);

    // cleanup: remove report file
    const reportsDir = path.join(__dirname, '..', 'reports');
    const filePath = path.join(reportsDir, `${job.reportId}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
});
