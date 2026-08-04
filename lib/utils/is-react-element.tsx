import React from "react";

export const isReactElement = (element: {} | null | undefined) => {
  return React.isValidElement(element);
};
