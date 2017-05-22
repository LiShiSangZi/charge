'use strict';

/**
 * Tag service is used to calculate the tag from speicifc url.
 */
module.exports = (app) => {
  class TagService extends app.Service {
    fetchTag(pathArray, url) {
      if (pathArray.length > 0) {
        switch (pathArray[1]) {
          case 'listeners.json':
            return 'listener';
        }

        if (pathArray.length > 2 && pathArray[2] === 'restore') {
          return 'volume';
        }
      }
      return pathArray[0].replace(/(e*)s$/, '$1');
    }
  }
  return TagService;
};
