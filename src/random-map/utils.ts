import { PositionData } from "@lob-sdk/types";
import { clamp, getRandomInt } from "@lob-sdk/utils";
import { Point2 } from "@lob-sdk/vector";

export const getPosition = (
  position: PositionData,
  width: number,
  height: number,
  randomFn?: () => number
): [number, number] => {
  switch (position.type) {
    case "exact": {
      const [percentageX, percentageY] = position.coords;

      const positionX = Math.floor(width * (percentageX / 100));
      const positionY = Math.floor(height * (percentageY / 100));

      return [positionX, positionY];
    }

    case "range": {
      const [minX, minY] = position.min;
      const [maxX, maxY] = position.max;

      const percentageX = getRandomInt(minX, maxX, randomFn);
      const percentageY = getRandomInt(minY, maxY, randomFn);

      const positionX = Math.floor(width * (percentageX / 100));
      const positionY = Math.floor(height * (percentageY / 100));

      return [positionX, positionY];
    }
  }
};

export function convertTo01Range(value: number): number {
  return clamp((value + 1) / 2, 0, 1);
}

