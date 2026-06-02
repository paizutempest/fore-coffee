import fetch from "node-fetch";
import dayjs from "dayjs";

export const getRandomNumber = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const fetchRandomUser = async () => {
  const res = await fetch("https://randomuser.me/api?nat=id");
  const data = await res.json();
  return data.results[0];
};

export const generateRandomIdentity = (randomUser) => {
  const fullName = `${randomUser.name.first} ${randomUser.name.last}`;
  const birthday = dayjs()
    .subtract(getRandomNumber(19, 25), "year")
    .format("YYYY-MM-DD");
  const email = `${randomUser.name.first.toLowerCase()}${getRandomNumber(100, 999)}@gmail.com`;
  return { fullName, birthday, email };
};
