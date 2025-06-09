import { useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import MovieCard from "./MovieCard";
import Spinner from "./Spinner";
import { updateSearchCount } from "../appwrite";

const API_BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const API_OPTIONS = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
};

const fetchMoviePage = async ({ pageParam = 1, queryKey }) => {
  const [_key, query] = queryKey;
  const endpoint = query
    ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&page=${pageParam}`
    : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc&page=${pageParam}`;

  const response = await fetch(endpoint, API_OPTIONS);
  console.log(`Fetching movies from:`, response); // Log the endpoint being fetched

  if (!response.ok) {
    throw new Error("Failed to fetch movies");
  }

  const data = await response.json();

  if (query && data.results?.length > 0) {
    await updateSearchCount(query, data.results[0]);
  }

  return {
    movies: data.results,
    nextPage: pageParam + 1,
    totalPages: data.total_pages,
  };
};

const AllMovies = ({ searchTerm }) => {
  const observerTarget = useRef(null);

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
    queryKey: ["movies", searchTerm],
    queryFn: fetchMoviePage,
    getNextPageParam: (lastPage, pages) => {
      if (pages.length < lastPage.totalPages) {
        return lastPage.nextPage;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const handleObserver = useCallback(
    (entries) => {
      const [target] = entries;
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = observerTarget.current;
    const option = {
      root: null,
      rootMargin: "20px",
      threshold: 0,
    };

    const observer = new IntersectionObserver(handleObserver, option);
    if (element) observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);
  return (
    <section className="all-movies">
      <h2>All Movies</h2>

      {status === "loading" ? (
        <Spinner />
      ) : status === "error" ? (
        <p className="text-red-500">{error.message}</p>
      ) : (
        <>
          <ul>{data?.pages.map((page) => page.movies.map((movie) => <MovieCard key={movie.id} movie={movie} />))}</ul>

          <div ref={observerTarget} className="loading-more">
            {isFetchingNextPage ? (
              <Spinner />
            ) : hasNextPage ? (
              <p>Loading more movies...</p>
            ) : (
              <p>No more movies to load.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default AllMovies;
