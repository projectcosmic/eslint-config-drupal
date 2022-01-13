/**
 * @file
 * Sync ESlint config from latest Drupal core release.
 */

/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": ["build.js"]}] */
/* eslint no-console: "off" */

const fs = require('fs/promises');
const https = require('https');
const { parseStringPromise } = require('xml2js');
const selfPackage = require('./package.json');

/**
 * Gets string data from a URL.
 *
 * @param {string} url The URL to GET.
 * @return {Promise<string>} Response body.
 */
const get = (url) =>
  new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': '@projectcosmic/eslint-config-drupal',
      },
    };

    https.get(url, options, (response) => {
      const { statusCode } = response;

      // Any 2xx status code signals a successful response but here we're only
      // checking for 200.
      if (statusCode !== 200) {
        reject(
          new Error(`Request Failed for ${url}. Status Code: ${statusCode}`),
        );
        // Consume response data to free up memory.
        response.resume();
        return;
      }

      response.setEncoding('utf8');

      let rawData = '';
      response.on('error', reject);
      response.on('data', (chunk) => {
        rawData += chunk;
      });
      response.on('end', () => {
        try {
          resolve(rawData);
        } catch (error) {
          reject(error);
        }
      });
    });
  });

/**
 * Updates the eslint config.
 *
 * @param {string} tag The tag name to use.
 */
const setESlintConfig = async (tag) =>
  fs.writeFile(
    '.eslintrc.json',
    await get(
      `https://git.drupalcode.org/project/drupal/-/raw/${tag}/core/.eslintrc.json`,
    ),
  );

/**
 * Updates the eslint dependencies.
 *
 * @param {string} tag The tag name to use.
 */
const setESLintDependencies = async (tag) => {
  const drupalPackage = JSON.parse(
    await get(
      `https://git.drupalcode.org/project/drupal/-/raw/${tag}/core/package.json`,
    ),
  );
  const eslintDependencies = Object.fromEntries(
    Object.entries(drupalPackage.devDependencies).filter(([name]) =>
      /^eslint(-.+)?/.test(name),
    ),
  );

  selfPackage.peerDependencies = eslintDependencies;
  selfPackage.devDependencies = {
    ...eslintDependencies,
    ...selfPackage.devDependencies,
  };
  fs.writeFile('package.json', JSON.stringify(selfPackage, undefined, 2));
};

get('https://updates.drupal.org/release-history/drupal/current')
  .then(parseStringPromise)
  .then((data) =>
    data.project.releases[0].release
      .filter(({ tag: [tag] }) => /(\d+\.){2}\d+/.test(tag))
      .slice(0, 1)
      .forEach(async ({ tag: [tag] }) => {
        console.log(`Syncing for version ${tag}`);
        setESlintConfig(tag);
        setESLintDependencies(tag);
      }),
  )
  .catch((error) => console.error(error));
