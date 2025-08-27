async function globalTeardown() {
  // Global teardown can be used to clean up shared resources
  console.log('Finished e2e tests.');
}

export default globalTeardown;
