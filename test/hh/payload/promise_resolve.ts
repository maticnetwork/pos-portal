export const promiseResolve = <T>(value?: any) => {
  return Promise.resolve<T>(value);
};
